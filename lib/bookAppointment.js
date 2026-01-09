// /lib/bookAppointment.js
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { toDayKey } from "./dates";

export async function bookAppointment({
  patientUID,
  patientName,
  doctorUID,
  when,
  timeZone = "Africa/Cairo",   // 👈 Egypt timezone
  extra = {},
}) {
  if (!patientUID || !doctorUID || !when) {
    throw new Error("Missing required fields (patientUID, doctorUID, when)");
  }

  const whenDate = when?.toDate ? when.toDate() : new Date(when);
  const whenTs = Timestamp.fromDate(whenDate);

  const dayKey = toDayKey(whenDate, timeZone);
  const counterId = `${doctorUID}:${dayKey}`;

  const countersRef = doc(db, "appointment_counters", counterId);
  const apptsCol = collection(db, "appointments");

  let out = { appointmentId: "", queueNumber: 0, dayKey };

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(countersRef);
    const nextNumber = snap.exists() ? (snap.data().nextNumber || 1) : 1;

    const queueNumber = nextNumber;

    tx.set(
      countersRef,
      { nextNumber: queueNumber + 1, updatedAt: serverTimestamp() },
      { merge: true }
    );

    const apptRef = doc(apptsCol);
    tx.set(apptRef, {
      patientUID,
      patientName: patientName || "",
      doctorUID,
      appointmentDate: whenTs,
      status: "pending",
      queueDayKey: dayKey,
      queueNumber,
      createdAt: serverTimestamp(),
      source: 'Doctor_app', // Tag to identify bookings from doctor app
      ...extra, // Allow override of source if provided in extra
    });

    out = { appointmentId: apptRef.id, queueNumber, dayKey };
  });

  return out;
}
