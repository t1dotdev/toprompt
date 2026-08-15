import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { notFound } from '@tanstack/react-router'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db'
import { project, prompt } from '../db/schema'
import { auth } from './auth'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(() =>
  auth.api.getSession({ headers: getRequestHeaders() }),
)

async function requireUser() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw new Error('Unauthorized')
  return session.user
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== 'string') throw new Error('Invalid input')
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) throw new Error('Invalid input')
  return trimmed
}

// The list is the app's home screen, so it carries how much is left in each
// queue — a bare list of names says nothing about where the work is.
export const listProjectsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  return db
    .select({
      id: project.id,
      name: project.name,
      pinned: project.pinned,
      createdAt: project.createdAt,
      total: count(prompt.id),
      open: count(sql`case when ${prompt.done} then null else 1 end`),
    })
    .from(project)
    .leftJoin(prompt, eq(prompt.projectId, project.id))
    .where(eq(project.userId, user.id))
    .groupBy(project.id)
    // Pinned first, then whatever was worked on last. createdAt only breaks
    // ties between two projects touched at the same instant.
    .orderBy(desc(project.pinned), desc(project.updatedAt), desc(project.createdAt))
})

export type ProjectSummary = Awaited<ReturnType<typeof listProjectsFn>>[number]

export const createProjectFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => ({ name: cleanText(data.name, 200) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    // The id comes back so the caller can send the user straight into the queue
    // it just made.
    const [created] = await db
      .insert(project)
      .values({ name: data.name, userId: user.id })
      .returning({ id: project.id })
    if (!created) throw new Error('Could not create project')
    return created
  })

export const setProjectPinnedFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string; pinned: boolean }) => ({
    id: cleanText(data.id, 100),
    pinned: Boolean(data.pinned),
  }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    await db
      .update(project)
      .set({ pinned: data.pinned })
      .where(and(eq(project.id, data.id), eq(project.userId, user.id)))
  })

export const deleteProjectFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => ({ id: cleanText(data.id, 100) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    await db
      .delete(project)
      .where(and(eq(project.id, data.id), eq(project.userId, user.id)))
  })

export const getProjectFn = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => ({ id: cleanText(data.id, 100) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [proj] = await db
      .select()
      .from(project)
      .where(and(eq(project.id, data.id), eq(project.userId, user.id)))
    if (!proj) throw notFound()
    const prompts = await db
      .select()
      .from(prompt)
      .where(eq(prompt.projectId, proj.id))
      .orderBy(desc(prompt.createdAt), desc(prompt.id))
    return { project: proj, prompts }
  })

// ownership of prompts is enforced via the project subquery in the WHERE clause
const ownedProjectIds = (userId: string) =>
  db.select({ id: project.id }).from(project).where(eq(project.userId, userId))

// Every prompt write is activity on its project, and that is what the list
// sorts on. The id always comes from a row the caller was already allowed to
// write, so there is no second ownership check to make here.
async function touchProject(id: string | undefined) {
  if (!id) return
  await db.update(project).set({ updatedAt: new Date() }).where(eq(project.id, id))
}

export const createPromptFn = createServerFn({ method: 'POST' })
  .validator((data: { projectId: string; text: string }) => ({
    projectId: cleanText(data.projectId, 100),
    text: cleanText(data.text, 10000),
  }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [proj] = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, data.projectId), eq(project.userId, user.id)))
    if (!proj) throw new Error('Unauthorized')
    await db.insert(prompt).values({ projectId: proj.id, text: data.text })
    await touchProject(proj.id)
  })

export const togglePromptFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string; done: boolean }) => ({
    id: cleanText(data.id, 100),
    done: Boolean(data.done),
  }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [updated] = await db
      .update(prompt)
      .set({ done: data.done })
      .where(and(eq(prompt.id, data.id), inArray(prompt.projectId, ownedProjectIds(user.id))))
      .returning({ projectId: prompt.projectId })
    await touchProject(updated?.projectId)
  })

export const deletePromptFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => ({ id: cleanText(data.id, 100) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [deleted] = await db
      .delete(prompt)
      .where(and(eq(prompt.id, data.id), inArray(prompt.projectId, ownedProjectIds(user.id))))
      .returning({ projectId: prompt.projectId })
    await touchProject(deleted?.projectId)
  })

// Backs the undo toast. Reinserting the original id and createdAt puts the row
// back in the exact slot it was deleted from rather than at the top of the queue.
export const restorePromptFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      id: string
      projectId: string
      text: string
      done: boolean
      createdAt: string
    }) => {
      const createdAt = new Date(data.createdAt)
      if (Number.isNaN(createdAt.getTime())) throw new Error('Invalid input')
      return {
        id: cleanText(data.id, 100),
        projectId: cleanText(data.projectId, 100),
        text: cleanText(data.text, 10000),
        done: Boolean(data.done),
        createdAt,
      }
    },
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const [proj] = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, data.projectId), eq(project.userId, user.id)))
    if (!proj) throw new Error('Unauthorized')
    await db.insert(prompt).values(data).onConflictDoNothing()
    await touchProject(proj.id)
  })
