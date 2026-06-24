import { FieldValue, Firestore } from "@google-cloud/firestore";
import type { DaikinTokenSet } from "./types";

const HOUSEHOLDS_COLLECTION = "households";
const TOKENS_SUBCOLLECTION = "tokens";

let firestoreClient: Firestore | null = null;

function getFirestoreClient(projectId: string): Firestore {
  if (!firestoreClient) {
    firestoreClient = new Firestore({ projectId });
  }
  return firestoreClient;
}

function isDaikinTokenSet(value: unknown): value is DaikinTokenSet {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "access_token" in value &&
    typeof value.access_token === "string" &&
    value.access_token.length > 0
  );
}

function enrichToken(token: DaikinTokenSet): DaikinTokenSet {
  const enriched: DaikinTokenSet = { ...token };
  if (enriched.expires_in !== undefined && enriched.expires_at === undefined) {
    enriched.expires_at = Math.floor(Date.now() / 1000) + enriched.expires_in;
  }
  return enriched;
}

function tokenFromDocumentData(data: unknown): DaikinTokenSet | null {
  if (!isDaikinTokenSet(data)) {
    return null;
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    expires_at: data.expires_at,
    token_type: data.token_type,
    scope: data.scope,
  };
}

export async function readCurrentTokenFromFirestore(
  projectId: string,
  householdId: string,
): Promise<DaikinTokenSet | null> {
  const db = getFirestoreClient(projectId);
  const snapshot = await db
    .collection(HOUSEHOLDS_COLLECTION)
    .doc(householdId)
    .collection(TOKENS_SUBCOLLECTION)
    .where("isCurrent", "==", true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return tokenFromDocumentData(snapshot.docs[0].data());
}

export async function writeCurrentTokenToFirestore(
  projectId: string,
  householdId: string,
  token: DaikinTokenSet,
): Promise<void> {
  const db = getFirestoreClient(projectId);
  const householdRef = db.collection(HOUSEHOLDS_COLLECTION).doc(householdId);
  const tokensRef = householdRef.collection(TOKENS_SUBCOLLECTION);
  const enriched = enrichToken(token);

  const existingCurrent = await tokensRef
    .where("isCurrent", "==", true)
    .get();

  const batch = db.batch();

  for (const doc of existingCurrent.docs) {
    batch.update(doc.ref, { isCurrent: false });
  }

  const newTokenRef = tokensRef.doc();
  batch.set(newTokenRef, {
    ...enriched,
    isCurrent: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(
    householdRef,
    {
      id: householdId,
      currentTokenId: newTokenRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
}
