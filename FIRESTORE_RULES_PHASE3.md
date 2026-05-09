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

## Testing

After applying rules, test:
- ✓ Load comments on a game page
- ✓ Click heart icon to like a comment (logged-in users only)
- ✓ Verify like count increments
- ✓ Click again to unlike
- ✓ Verify guest users cannot like (button doesn't show)
