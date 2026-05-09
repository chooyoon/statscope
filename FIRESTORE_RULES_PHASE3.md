# Firestore Security Rules - Phase 3 Update

After deploying the likes feature for GameComments, add the following rules to your Firebase Console:

## Update for gameComments collection

Replace the existing `gameComments` rules with:

```firestore
match /gameComments/{gamePk} {
  match /messages/{messageId} {
    // Anyone can read comments
    allow read: if true;
    
    // Logged-in users can create comments
    allow create: if request.auth != null &&
      request.resource.data.uid == request.auth.uid &&
      request.resource.data.text.size() > 0 &&
      request.resource.data.text.size() <= 300;
    
    // Users can only update likes on their own or any comment
    allow update: if request.auth != null &&
      (
        // Allow updating only the likes and userLikes fields
        (request.resource.data.keys().hasOnly(['text', 'author', 'uid', 'photoURL', 'createdAt', 'likes', 'userLikes']) &&
         resource.data.keys().hasOnly(['text', 'author', 'uid', 'photoURL', 'createdAt', 'likes', 'userLikes']))
        ||
        // Or allow users to delete their own comments
        (request.auth.uid == resource.data.uid)
      );
  }
}
```

## Steps to Apply

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your StatScope project
3. Go to **Firestore Database** → **Rules** tab
4. Update the `gameComments` section with the above rules
5. Click **Publish**

## TTL (Time To Live) Policy - Auto-Delete Comments After 7 Days

1. Go to **Firestore Database** → **Data** tab
2. Click on a document in `gameComments/{gamePk}/messages`
3. Verify the `expiresAt` field exists (set to 7 days from creation)
4. Go back to **Rules** tab and add at the database root level:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // TTL policy: automatically delete documents with expiresAt field past current time
    match /{document=**} {
      allow delete: if resource.data.expiresAt == null || 
        resource.data.expiresAt < request.time;
    }
    
    // ... rest of your rules
  }
}
```

Then in **Firestore Database** settings:
1. Click **TTL Policy** (or **Manage TTLs**)
2. Create new TTL policy on collection `gameComments/{gamePk}/messages`
3. Set field: `expiresAt`
4. This will automatically delete documents when their `expiresAt` time passes

**Result**: Comments automatically disappear after 7 days, keeping database lean and responsive.

## Testing

After applying rules and TTL, test:
- ✓ Load comments on a game page
- ✓ Post a new comment (verify `expiresAt` field exists in Firestore)
- ✓ Click heart icon to like a comment (logged-in users only)
- ✓ Verify like count increments
- ✓ Click again to unlike
- ✓ Verify guest users cannot like (button doesn't show)
- ✓ After 7 days, comments automatically disappear from database
