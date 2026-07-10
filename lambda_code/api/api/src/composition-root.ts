import {
  GetCommunityBenchmarksUseCase,
  GetPlayerProfileUseCase,
  GetProfileByGamerTagUseCase,
  LinkPlatformAccountUseCase,
  ListPlayerDailyTrendUseCase,
  ListPlayerMatchesUseCase,
  ListPlayerStatsRollupsUseCase,
  ListWeeklyLeaderboardUseCase,
  SearchPlayersUseCase,
  UpsertPlayerProfileUseCase,
} from '@stats-games/application';
import {
  ConsoleLogger,
  DynamoDbCommunityStatsRepository,
  DynamoDbMatchRepository,
  DynamoDbPlayerProfileRepository,
  DynamoDbStatsSummaryRepository,
} from '@stats-games/infrastructure';

const logger = new ConsoleLogger({ source: 'appsync_api' });

const playerProfiles = new DynamoDbPlayerProfileRepository();
const matchRepository = new DynamoDbMatchRepository();
const statsRepository = new DynamoDbStatsSummaryRepository();
const communityStatsRepository = new DynamoDbCommunityStatsRepository();

export const getPlayerProfile = new GetPlayerProfileUseCase(playerProfiles);
export const getProfileByGamerTag = new GetProfileByGamerTagUseCase(playerProfiles);
export const searchPlayers = new SearchPlayersUseCase(playerProfiles);
export const upsertPlayerProfile = new UpsertPlayerProfileUseCase({
  repository: playerProfiles,
  logger,
});
export const linkPlatformAccount = new LinkPlatformAccountUseCase({
  repository: playerProfiles,
  logger,
});
export const listPlayerMatches = new ListPlayerMatchesUseCase(matchRepository);
export const listPlayerStatsRollups = new ListPlayerStatsRollupsUseCase(statsRepository);
export const listPlayerDailyTrend = new ListPlayerDailyTrendUseCase(statsRepository);
export const getCommunityBenchmarks = new GetCommunityBenchmarksUseCase(communityStatsRepository);
export const listWeeklyLeaderboard = new ListWeeklyLeaderboardUseCase(
  communityStatsRepository,
  playerProfiles,
);
