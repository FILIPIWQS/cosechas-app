import pkg from '../../../../package.json';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ versao: pkg.version });
}
