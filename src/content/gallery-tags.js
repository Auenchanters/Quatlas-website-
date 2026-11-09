// Photos kept in the repo (assets-src, `npm run images`) instead of the dashboard. They show first.
export const REPO_PHOTOS = ['event-team-seated', 'event-field-2', 'event-field-1', 'event-chennai-planes', 'event-chennai-pilot',
  'event-orientation', 'event-pradarshana-1', 'event-pradarshana-2', 'event-workshop'].map((img) => ({ _id: img, img }));

// Dashboard photos kept off the site (the team picked them out, Nov 2026), by the photo's _id. They stay in
// the dashboard; take an id out to bring a photo back. Every new upload shows.
export const HIDDEN = new Set([
  '68e33a6ded6f2a7e0369d0e8', '68e33a5fed6f2a7e0369d0e4', '68e33a5aed6f2a7e0369d0e2', '68e33a54ed6f2a7e0369d0e0',
  '68e339fced6f2a7e0369d0d5', '68e336d71996c8a0f843ea4e', '68e336cf1996c8a0f843ea4b', '68e33239b17a43e77c224ea3',
  '68e212d99b98d624120b1527', '68e212d39b98d624120b1525', '68e212759b98d624120b151c', '68e210a2cf3f3b27c62a777d',
  '68e20ed491d056032a30dd0b', '68e20d8dcf3f3b27c62a772d',
  // second pass, 9 Nov 2026
  '68e33a67ed6f2a7e0369d0e6', '68e33a0fed6f2a7e0369d0de', '68e337171996c8a0f843ea56', '68e337111996c8a0f843ea54',
  '68e336c61996c8a0f843ea47', '68e33244b17a43e77c224ea7', '68e3323fb17a43e77c224ea5', '68e3307fa8b459c1f7983ab9',
  '68e3307aa8b459c1f7983ab7', '68e33075a8b459c1f7983ab5', '68e3306da8b459c1f7983ab3', '68e3302ba8b459c1f7983ab1',
  '68e33020a8b459c1f7983aad', '68e33018a8b459c1f7983aab', '68e32fd9a8b459c1f7983aa9', '68e32fd1a8b459c1f7983aa7',
  '68e32fcca8b459c1f7983aa5', '68e32fc4a8b459c1f7983aa3', '68e32f91b17a43e77c224e7b', '68e32f8cb17a43e77c224e79',
  '68e32f801534e357124b1cba', '68e32f7a1534e357124b1cb8', '68e210a8cf3f3b27c62a777f', '68e20f7791d056032a30dd3c',
  '68e20f6f91d056032a30dd3a', '68e20f3391d056032a30dd38', '68e20f2c91d056032a30dd36',
  '68e20ebf91d056032a30dd05', '68e16297d226f9e47dd73ecb', // duplicates of photos that stay
  '699d372983a53699aa52fc6e', // broken link
]);

export const visible = (items, hidden = HIDDEN) => items.filter((it) => !hidden.has(it._id));
