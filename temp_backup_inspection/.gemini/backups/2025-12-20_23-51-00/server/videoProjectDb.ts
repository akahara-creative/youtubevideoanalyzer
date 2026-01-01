import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  videoProjects,
  videoScenes,
  videoSlides,
  InsertVideoProject,
  InsertVideoScene,
  InsertVideoSlide,
} from "../drizzle/schema";

/**
 * Create a new video project
 */
export async function createVideoProject(data: InsertVideoProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(videoProjects).values(data);
  return result.insertId;
}

/**
 * Get video project by ID and user
 */
export async function getVideoProjectByIdAndUser(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [project] = await db
    .select()
    .from(videoProjects)
    .where(eq(videoProjects.id, projectId))
    .limit(1);

  if (!project || project.userId !== userId) {
    return null;
  }

  return project;
}

/**
 * Get all video projects for a user
 */
export async function getVideoProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(videoProjects)
    .where(eq(videoProjects.userId, userId))
    .orderBy(desc(videoProjects.updatedAt));
}

/**
 * Update video project
 */
export async function updateVideoProject(
  projectId: number,
  data: Partial<InsertVideoProject>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoProjects)
    .set(data)
    .where(eq(videoProjects.id, projectId));
}

/**
 * Delete video project
 */
export async function deleteVideoProject(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete related scenes and slides first
  const scenes = await db
    .select()
    .from(videoScenes)
    .where(eq(videoScenes.projectId, projectId));

  for (const scene of scenes) {
    await db.delete(videoSlides).where(eq(videoSlides.sceneId, scene.id));
  }

  await db.delete(videoScenes).where(eq(videoScenes.projectId, projectId));
  await db.delete(videoProjects).where(eq(videoProjects.id, projectId));
}

/**
 * Create a new video scene
 */
export async function createVideoScene(data: InsertVideoScene) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(videoScenes).values(data);
  return result.insertId;
}

/**
 * Get scenes by project ID
 */
export async function getScenesByProjectId(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(videoScenes)
    .where(eq(videoScenes.projectId, projectId))
    .orderBy(videoScenes.sceneNumber);
}

/**
 * Update video scene
 */
export async function updateVideoScene(
  sceneId: number,
  data: Partial<InsertVideoScene>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoScenes)
    .set(data)
    .where(eq(videoScenes.id, sceneId));
}

/**
 * Delete video scene
 */
export async function deleteVideoScene(sceneId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(videoSlides).where(eq(videoSlides.sceneId, sceneId));
  await db.delete(videoScenes).where(eq(videoScenes.id, sceneId));
}

/**
 * Create a new video slide
 */
export async function createVideoSlide(data: InsertVideoSlide) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(videoSlides).values(data);
  return result.insertId;
}

/**
 * Get slides by scene ID
 */
export async function getSlidesBySceneId(sceneId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(videoSlides)
    .where(eq(videoSlides.sceneId, sceneId))
    .orderBy(videoSlides.slideNumber);
}

/**
 * Update video slide
 */
export async function updateVideoSlide(
  slideId: number,
  data: Partial<InsertVideoSlide>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(videoSlides)
    .set(data)
    .where(eq(videoSlides.id, slideId));
}

/**
 * Delete video slide
 */
export async function deleteVideoSlide(slideId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(videoSlides).where(eq(videoSlides.id, slideId));
}
