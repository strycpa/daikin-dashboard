import { FieldValue, Firestore } from "@google-cloud/firestore";

const HOUSEHOLDS_COLLECTION = "households";
const DEVICE_NAMES_SUBCOLLECTION = "deviceNames";

let firestoreClient: Firestore | null = null;

function getFirestoreClient(projectId: string): Firestore {
  if (!firestoreClient) {
    firestoreClient = new Firestore({ projectId });
  }
  return firestoreClient;
}

export interface DeviceNameRecord {
  deviceId: string;
  customName: string | null;
  cloudName: string | null;
  updatedAt?: Date;
}

export async function readDeviceNames(
  projectId: string,
  householdId: string,
): Promise<Record<string, DeviceNameRecord>> {
  const db = getFirestoreClient(projectId);
  const snapshot = await db
    .collection(HOUSEHOLDS_COLLECTION)
    .doc(householdId)
    .collection(DEVICE_NAMES_SUBCOLLECTION)
    .get();

  const result: Record<string, DeviceNameRecord> = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    result[doc.id] = {
      deviceId: doc.id,
      customName: typeof data.customName === "string" ? data.customName : null,
      cloudName: typeof data.cloudName === "string" ? data.cloudName : null,
      updatedAt: data.updatedAt?.toDate?.() ?? undefined,
    };
  }

  return result;
}

export async function writeDeviceName(
  projectId: string,
  householdId: string,
  deviceId: string,
  customName: string | null,
  cloudName: string | null,
): Promise<void> {
  const db = getFirestoreClient(projectId);
  const docRef = db
    .collection(HOUSEHOLDS_COLLECTION)
    .doc(householdId)
    .collection(DEVICE_NAMES_SUBCOLLECTION)
    .doc(deviceId);

  await docRef.set(
    {
      customName: customName ?? null,
      cloudName: cloudName ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function syncCloudNames(
  projectId: string,
  householdId: string,
  devices: Array<{ id: string; cloudName: string | null }>,
): Promise<void> {
  const db = getFirestoreClient(projectId);
  const batch = db.batch();
  const collectionRef = db
    .collection(HOUSEHOLDS_COLLECTION)
    .doc(householdId)
    .collection(DEVICE_NAMES_SUBCOLLECTION);

  for (const device of devices) {
    const docRef = collectionRef.doc(device.id);
    batch.set(
      docRef,
      {
        cloudName: device.cloudName ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  await batch.commit();
}
