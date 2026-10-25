import { CATEGORY_INFO, type Category } from "@/lib/categories";
import { MAX_UPDATE_PHOTOS } from "@/lib/photos";

// Campaign update types and their rules. The browser checks these before
// uploading photos; the server checks them again before saving, and the
// database refuses a type the campaign's category doesn't allow.

export const UPDATE_TYPES = {
  gift: { label: "Gift received", emoji: "🎁", hint: "Something given in kind, like a bed or utensils." },
  recovery: { label: "Recovery update", emoji: "🩺", hint: "How the patient is doing." },
  progress: { label: "Progress", emoji: "📈", hint: "How things are moving along, e.g. before and after." },
  general: { label: "General", emoji: "📣", hint: "News or a thank-you." },
} as const;

export type UpdateType = keyof typeof UPDATE_TYPES;

// Gift and General suit every campaign. Medical campaigns post recovery
// updates; every other category posts progress updates.
export function updateTypesFor(category: Category): UpdateType[] {
  return category === "Medical" ? ["gift", "recovery", "general"] : ["gift", "progress", "general"];
}

// Progress updates are named after the category, e.g. "Wedding preparations".
export function updateLabel(type: UpdateType, category: Category): string {
  return type === "progress" ? (CATEGORY_INFO[category].progress ?? UPDATE_TYPES.progress.label) : UPDATE_TYPES[type].label;
}

export function updateEmoji(type: UpdateType, category: Category): string {
  return type === "progress" ? CATEGORY_INFO[category].icon : UPDATE_TYPES[type].emoji;
}

export const RECOVERY_STATUSES = {
  in_hospital: "In hospital",
  recovering: "Recovering",
  back_home: "Back home",
  fully_recovered: "Fully recovered",
} as const;

export type RecoveryStatus = keyof typeof RECOVERY_STATUSES;

export const MAX_BODY = 2000;
export const MAX_GIFT_ITEM = 80;
export const MAX_GIFT_GIVER = 60;
export const MAX_GIFT_VALUE = 50_000_000;

// What the update form sends, as typed.
export type UpdateValues = {
  type: string;
  body: string;
  giftItem: string;
  giftGiver: string;
  giftAnonymous: boolean;
  giftValue: string;
  recoveryStatus: string;
  consent: boolean;
};

export type UpdateField = "type" | "body" | "giftItem" | "giftGiver" | "giftValue" | "recoveryStatus" | "photos" | "consent";
export type UpdateErrors = Partial<Record<UpdateField, string>>;

export function isUpdateType(type: unknown): type is UpdateType {
  return typeof type === "string" && Object.hasOwn(UPDATE_TYPES, type);
}

export function isRecoveryStatus(status: unknown): status is RecoveryStatus {
  return typeof status === "string" && Object.hasOwn(RECOVERY_STATUSES, status);
}

// Pass the campaign's category for new updates. Edits leave it out, because
// the type can't change (and older updates may predate the category rule).
export function updateErrors(v: UpdateValues, photoCount: number, category?: Category): UpdateErrors {
  const errors: UpdateErrors = {};
  if (!isUpdateType(v.type) || (category && !updateTypesFor(category).includes(v.type))) {
    errors.type = "Choose what kind of update this is.";
    return errors;
  }

  const body = v.body.trim();
  if (v.type !== "gift" && !body) errors.body = "Write a few words about the update.";
  if (body.length > MAX_BODY) errors.body = `Keep it under ${MAX_BODY.toLocaleString("en-KE")} characters.`;

  if (v.type === "gift") {
    const item = v.giftItem.trim();
    if (!item) errors.giftItem = "What was given? e.g. a bed";
    if (item.length > MAX_GIFT_ITEM) errors.giftItem = `Keep it under ${MAX_GIFT_ITEM} characters.`;
    const giver = v.giftGiver.trim();
    if (!v.giftAnonymous && !giver) errors.giftGiver = "Add the giver’s name, or tick Anonymous.";
    if (giver.length > MAX_GIFT_GIVER) errors.giftGiver = `Keep the name under ${MAX_GIFT_GIVER} characters.`;
    const value = v.giftValue.replace(/[,\s]/g, "");
    if (value && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > MAX_GIFT_VALUE)) {
      errors.giftValue = `Enter a whole amount in KES, or leave it empty.`;
    }
  }

  if (v.type === "recovery") {
    if (v.recoveryStatus && !isRecoveryStatus(v.recoveryStatus)) errors.recoveryStatus = "Choose a status.";
    if (photoCount > 0 && !v.consent) errors.consent = "Tick this to confirm you have the patient’s consent.";
  }

  if (photoCount > MAX_UPDATE_PHOTOS) errors.photos = `Add up to ${MAX_UPDATE_PHOTOS} photos.`;
  return errors;
}
