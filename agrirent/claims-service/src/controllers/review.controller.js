const asyncHandler = require('../utils/asyncHandler');
const reviewService = require('../services/review.service');
const { handleETag } = require('../middleware/etag.middleware');
const { sendNegotiatedResponse } = require('../middleware/contentNegotiation.middleware');

const submitReview = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { targetUserId, rating, feedback } = req.body;
  const reviewerId = req.user.id;
  const correlationId = req.correlationId;

  const result = await reviewService.submitReview({
    bookingId,
    reviewerId,
    targetUserId,
    rating,
    feedback,
    user: req.user,
    correlationId,
  });

  res.status(201).json(result);
});

const getReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  const result = await reviewService.getReview(reviewId);

  // ETag + 304 handling
  if (handleETag(req, res, result)) {
    return;
  }

  sendNegotiatedResponse(req, res, 200, result, 'review');
});

const listReviews = asyncHandler(async (req, res) => {
  const { targetUserId, bookingId, limit, cursor } = req.query;

  const result = await reviewService.listReviews({
    targetUserId,
    bookingId,
    limit,
    cursor,
  });

  if (result.nextCursor) {
    const nextUrl = `${req.baseUrl}/reviews?limit=${limit || 10}&cursor=${encodeURIComponent(result.nextCursor)}${targetUserId ? `&targetUserId=${targetUserId}` : ''}${bookingId ? `&bookingId=${bookingId}` : ''}`;
    res.setHeader('Link', `<${nextUrl}>; rel="next"`);
    result.nextLink = nextUrl;
  }

  res.status(200).json(result);
});

const getReviewSummary = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const result = await reviewService.getReviewSummary(userId);

  // ETag + 304 handling
  if (handleETag(req, res, result)) {
    return;
  }

  sendNegotiatedResponse(req, res, 200, result, 'reviewSummary');
});

module.exports = {
  submitReview,
  getReview,
  listReviews,
  getReviewSummary,
};
