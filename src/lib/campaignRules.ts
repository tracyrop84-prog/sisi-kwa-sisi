// Checks shared by the create and edit campaign forms. The edit form runs them
// in the browser too, before uploading a new cover photo.

export type DetailField = "title" | "location" | "story";

export function campaignDetailErrors(v: Record<DetailField, string>): Partial<Record<DetailField, string>> {
  const errors: Partial<Record<DetailField, string>> = {};
  if (v.title.length < 5) errors.title = "Give your harambee a title (at least 5 characters).";
  if (v.title.length > 100) errors.title = "Keep the title under 100 characters.";
  if (!v.location) errors.location = "Add a town or county.";
  if (v.story.length < 30) errors.story = "Share a bit more of the story (at least 30 characters).";
  return errors;
}
