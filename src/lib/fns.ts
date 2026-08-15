import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { notFound } from '@tanstack/react-router'
import { and, desc, eq, inArray } from 'drizzle-orm'
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

export const listProjectsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  return db
    .select()
    .from(project)
    .where(eq(project.userId, user.id))
    .orderBy(desc(project.createdAt))
})

export const createProjectFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => ({ name: cleanText(data.name, 200) }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    await db.insert(project).values({ name: data.name, userId: user.id })
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
