// Which gallery photos show under "Aircraft" (planes, models, builds, flights), by the photo's _id
// from the dashboard. Every photo not listed here shows under "People", so new uploads never vanish.
export const AIRCRAFT = new Set([
  '68e33a6ded6f2a7e0369d0e8', // build
  '68e33a67ed6f2a7e0369d0e6', // build
  '68e33a5fed6f2a7e0369d0e4', // model
  '68e33a5aed6f2a7e0369d0e2', // model
  '68e33a54ed6f2a7e0369d0e0', // test
  '68e33a0fed6f2a7e0369d0de', // test
  '68e339fced6f2a7e0369d0d5', // model
  '68e3370b1996c8a0f843ea52', // models
  '68e336dc1996c8a0f843ea50', // model
  '68e336d71996c8a0f843ea4e', // model
  '68e336cf1996c8a0f843ea4b', // build
  '68e33239b17a43e77c224ea3', // models
  '68e212d99b98d624120b1527', // build
  '68e212d39b98d624120b1525', // field
  '68e212cb9b98d624120b1523', // model
  '68e2127a9b98d624120b151e', // flight
  '68e212759b98d624120b151c', // model
  '68e2126f9b98d624120b151a', // model
  '68e212669b98d624120b1518', // flight
  '68e21206cf3f3b27c62a7788', // model
  '68e21200cf3f3b27c62a7786', // model
  '68e210a2cf3f3b27c62a777d', // build
  '68e2105391d056032a30dd45', // model
  '68e2103d5cad4f502214336d', // model
  '68e210385cad4f502214336b', // build
  '68e210315cad4f5022143369', // flight
  '68e20fe35cad4f5022143340', // models
  '68e20fdd5cad4f502214333e', // model
  '68e20fd65cad4f502214333c', // build
  '68e20f8591d056032a30dd40', // model
  '68e20f2491d056032a30dd34', // flight
  '68e20ed491d056032a30dd0b', // model
  '68e20ece91d056032a30dd09', // model
  '68e20ec691d056032a30dd07', // model
  '68e20ebf91d056032a30dd05', // flight
  '68e20e6b91d056032a30dd03', // flight
  '68e20e355cad4f5022143337', // model
  '68e20e2e5cad4f5022143335', // model
  '68e20e255cad4f5022143333', // flight
  '68e20d8dcf3f3b27c62a772d', // model
  '68e20d5191d056032a30dcd9', // model
  '68e16297d226f9e47dd73ecb', // model
]);

export function splitGallery(items, aircraft = AIRCRAFT) {
  const out = { aircraft: [], people: [] };
  for (const it of items) (aircraft.has(it._id) ? out.aircraft : out.people).push(it);
  return out;
}
