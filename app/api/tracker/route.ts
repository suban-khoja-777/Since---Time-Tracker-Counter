// Legacy D1 API retired; authenticated clients now use Firestore rules.
export function GET(){return Response.json({error:'This API has moved to Firebase. Reload the app.'},{status:410,headers:{'Cache-Control':'no-store'}});}
export const POST=GET;
