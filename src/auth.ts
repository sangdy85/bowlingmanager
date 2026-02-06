// Extreme Mock for Diagnosis
export const auth: any = async () => null;
export const handlers: any = {
    GET: () => new Response("Mock Auth GET", { status: 200 }),
    POST: () => new Response("Mock Auth POST", { status: 201 }),
};
export const signIn: any = async () => null;
export const signOut: any = async () => null;
