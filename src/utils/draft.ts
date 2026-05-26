import { getCollection, type CollectionEntry } from 'astro:content'

/**
 * Get all posts, filtering out posts whose filenames start with _
 */
export async function getFilteredPosts() {
  const posts = await getCollection('posts')
  return posts.filter(
    (post: CollectionEntry<'posts'>) =>
      !post.id.startsWith('_') && !post.id.startsWith('basculante-') && !post.id.includes('/basculante-')
  )
}

/**
 * Get all posts sorted by publication date, filtering out posts whose filenames start with _
 */
export async function getSortedFilteredPosts() {
  const posts = await getFilteredPosts()
  return posts.sort(
    (a: CollectionEntry<'posts'>, b: CollectionEntry<'posts'>) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  )
}

/**
 * Posts in chronological order (oldest first), used for edition numbering.
 */
export async function getPostsChronological() {
  const posts = await getFilteredPosts()
  return posts.sort((a, b) => {
    const dateDiff = a.data.pubDate.valueOf() - b.data.pubDate.valueOf()
    if (dateDiff !== 0) return dateDiff
    return a.id.localeCompare(b.id)
  })
}

/**
 * Edition number for a post (1 = oldest published post), zero-padded to 2 digits.
 */
export async function getPostEditionNumber(postId: string): Promise<number> {
  const posts = await getPostsChronological()
  const index = posts.findIndex((post) => post.id === postId)
  return index === -1 ? 0 : index + 1
}

export function formatEditionNumber(editionNumber: number): string {
  return String(editionNumber).padStart(2, '0')
}
