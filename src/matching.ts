import { Post } from './types';

export interface MatchResult {
  post: Post;
  similarity: number; // 0 to 1
  reason: string;
}

/**
 * Calculates similarity between two posts of opposite types.
 * Returns a score between 0 and 1, and the reason for the match.
 */
export function calculateSimilarity(postA: Post, postB: Post): { similarity: number; reason: string } {
  // Only compare opposite types (lost <-> found)
  if (postA.type === postB.type) {
    return { similarity: 0, reason: '' };
  }

  let score = 0;
  const reasons: string[] = [];

  // 1. Tags matching (Weight: 40%)
  const commonTags = postA.tags.filter(t => postB.tags.includes(t));
  if (commonTags.length > 0) {
    const tagMatchRatio = commonTags.length / Math.max(postA.tags.length, 1);
    score += 0.4 * tagMatchRatio;
    reasons.push(`태그 일치 (${commonTags.join(', ')})`);
  }

  // 2. Title matching (Weight: 30%)
  const cleanTitleA = postA.title.toLowerCase().trim();
  const cleanTitleB = postB.title.toLowerCase().trim();
  
  // Direct substring check
  if (cleanTitleA.includes(cleanTitleB) || cleanTitleB.includes(cleanTitleA)) {
    score += 0.3;
    reasons.push('제목 문구 높은 유사도');
  } else {
    // Word-by-word token overlap
    const wordsA = cleanTitleA.split(/\s+/).filter(w => w.length > 1);
    const wordsB = cleanTitleB.split(/\s+/).filter(w => w.length > 1);
    const commonWords = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));
    
    if (commonWords.length > 0) {
      const wordMatchRatio = commonWords.length / Math.max(wordsA.length, 1);
      score += 0.25 * wordMatchRatio;
      reasons.push('제목 키워드 유사');
    }
  }

  // 3. Location matching (Weight: 30%)
  const cleanLocA = postA.location.toLowerCase().replace(/\s+/g, '');
  const cleanLocB = postB.location.toLowerCase().replace(/\s+/g, '');

  if (cleanLocA && cleanLocB) {
    if (cleanLocA.includes(cleanLocB) || cleanLocB.includes(cleanLocA)) {
      score += 0.3;
      reasons.push(`장소 명칭 일치 (${postB.location})`);
    } else {
      // Partial word matches
      const locWordsA = postA.location.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const locWordsB = postB.location.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const commonLocWords = locWordsA.filter(w => locWordsB.some(wb => wb.includes(w) || w.includes(wb)));
      
      if (commonLocWords.length > 0) {
        score += 0.15;
        reasons.push('장소 키워드 유사');
      }
    }
  }

  return {
    similarity: Math.min(score, 1.0),
    reason: reasons.join(', ')
  };
}

/**
 * Finds all matching posts of the opposite type, sorted by similarity descending.
 */
export function findMatchesForPost(targetPost: Post, allPosts: Post[], threshold: number = 0.25): MatchResult[] {
  const results: MatchResult[] = [];

  for (const candidate of allPosts) {
    if (candidate.id === targetPost.id || candidate.resolved) continue;

    const { similarity, reason } = calculateSimilarity(targetPost, candidate);
    if (similarity >= threshold) {
      results.push({
        post: candidate,
        similarity,
        reason
      });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}
