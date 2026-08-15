import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { notFound } from '@tanstack/react-router'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
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
      createdAt: project.createdAt,
      total: count(prompt.id),
      open: count(sql`case when ${prompt.done} then null else 1 end`),
    })
    .from(project)
    .leftJoin(prompt, eq(prompt.projectId, project.id))
    .where(eq(project.userId, user.id))
    .groupBy(project.id)
    .orderBy(asc(project.position), desc(project.createdAt))
})

export type ProjectSummary = Awaited<ReturnType<typeof listProjectsFn>>[number]

export const createProjectFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => ({ name: cleanText(data.name, 200) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    await db.insert(project).values({
      name: data.name,
      userId: user.id,
      // Sits above everything else, which is where new projects already
      // appeared before manual ordering existed. Two concurrent creates can
      // tie here; createdAt breaks it, so the worst case is harmless.
      position: sql<number>`(select coalesce(min(p.position), 0) - 1 from project p where p.user_id = ${user.id})`,
    })
  })

export const reorderProjectsFn = createServerFn({ method: 'POST' })
  .validator((data: { ids: Array<string> }) => {
    if (!Array.isArray(data.ids) || data.ids.length > 1000)
      throw new Error('Invalid input')
    return { ids: data.ids.map((id) => cleanText(id, 100)) }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (data.ids.length === 0) return
    // Rewrites the whole list in one statement so it can never be read
    // half-reordered. The userId guard means ids belonging to someone else
    // simply match nothing.
    // ponytail: fine to rewrite every row at this scale; switch to fractional
    // indexing only if a single user ever holds thousands of projects.
    const cases = sql.join(
      data.ids.map((id, i) => sql`when ${id} then ${i}`),
      sql` `,
    )
    await db
      .update(project)
      .set({ position: sql`case ${project.id} ${cases} else ${project.position} end` })
      .where(and(eq(project.userId, user.id), inArray(project.id, data.ids)))
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
  })

export const togglePromptFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string; done: boolean }) => ({
    id: cleanText(data.id, 100),
    done: Boolean(data.done),
  }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    await db
      .update(prompt)
      .set({ done: data.done })
      .where(and(eq(prompt.id, data.id), inArray(prompt.projectId, ownedProjectIds(user.id))))
  })

export const deletePromptFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => ({ id: cleanText(data.id, 100) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    await db
      .delete(prompt)
      .where(and(eq(prompt.id, data.id), inArray(prompt.projectId, ownedProjectIds(user.id))))
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
  })
