/**
 * Calculate Cosine Similarity between two face descriptors
 * @param {Array<Number>} descriptor1 - First face descriptor
 * @param {Array<Number>} descriptor2 - Second face descriptor
 * @returns {Number} - Similarity score (1.0 = identical, 0.0 = orthogonal)
 */
function calculateCosineSimilarity(descriptor1, descriptor2) {
  if (!descriptor1 || !descriptor2 || descriptor1.length !== descriptor2.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < descriptor1.length; i++) {
    dotProduct += descriptor1[i] * descriptor2[i];
    normA += descriptor1[i] * descriptor1[i];
    normB += descriptor2[i] * descriptor2[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate Euclidean distance between two face descriptors
 * @param {Array<Number>} descriptor1 - First face descriptor
 * @param {Array<Number>} descriptor2 - Second face descriptor
 * @returns {Number} - Distance between descriptors (lower = more similar)
 */
function calculateDistance(descriptor1, descriptor2) {
  if (!descriptor1 || !descriptor2 || descriptor1.length !== descriptor2.length) {
    return Infinity;
  }

  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Compare two face descriptors and determine if they match
 * @param {Array<Number>} descriptor1 - First face descriptor
 * @param {Array<Number>} descriptor2 - Second face descriptor
 * @param {Number} threshold - Minimum similarity for a match (default: 0.6)
 * @returns {Object} - Match result with similarity and isMatch flag
 */
function compareFaces(descriptor1, descriptor2, threshold = 0.6) {
  const similarity = calculateCosineSimilarity(descriptor1, descriptor2);
  const distance = calculateDistance(descriptor1, descriptor2);
  const isMatch = similarity > threshold;

  return {
    similarity,
    distance,
    isMatch,
    confidence: similarity * 100
  };
}

/**
 * Find best matching face from a list of descriptors
 * @param {Array<Number>} queryDescriptor - Face descriptor to match
 * @param {Array<Array<Number>>} candidateDescriptors - Array of face descriptors to search
 * @param {Number} threshold - Minimum similarity for a match (default: 0.6)
 * @returns {Object|null} - Best match with index and similarity, or null if no match
 */
function findBestMatch(queryDescriptor, candidateDescriptors, threshold = 0.6) {
  if (!candidateDescriptors || candidateDescriptors.length === 0) {
    return null;
  }

  let bestMatch = null;
  let maxSimilarity = -Infinity;

  candidateDescriptors.forEach((descriptor, index) => {
    const similarity = calculateCosineSimilarity(queryDescriptor, descriptor);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      bestMatch = {
        index,
        similarity,
        isMatch: similarity > threshold,
        confidence: similarity * 100
      };
    }
  });

  return bestMatch;
}

module.exports = {
  calculateDistance,
  calculateCosineSimilarity,
  compareFaces,
  findBestMatch
};

