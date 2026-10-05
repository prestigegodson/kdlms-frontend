/** `classId:learnerId` - a class conversation's identity before it has a thread id (creators Phase C11). */
export function conversationKey(row: { classId: string; learnerId: string }): string {
  return `${row.classId}:${row.learnerId}`;
}
