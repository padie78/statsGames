export { MEDIA_POLICY, MEDIA_LEGAL_DISCLAIMER, MEDIA_YOUTUBE_ATTRIBUTION_PREFIX } from './media.policy';
export type {
  MediaSourceType,
  MediaValidationResult,
  ResolvedYouTubeEmbed,
  SafeMediaAsset,
  SafeMediaMaxWidth,
} from './media.types';
export { MediaPlaybackRegistry } from './media-playback.registry';
export {
  MediaPolicyService,
  buildYouTubeEmbedUrl,
  formatYouTubeAttribution,
  isAllowedEmbedHost,
  isApiThumbnailHost,
  isForbiddenMediaSource,
  isOwnAssetUrl,
  prefersReducedMotion,
  resolveSafeAmbientVideoUrl,
  shouldDisableAmbientVideo,
  shouldUseStaticMediaMode,
  validateSafeMediaAsset,
} from './media-policy.util';
