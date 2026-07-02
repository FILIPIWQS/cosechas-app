import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const LOGO_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjQ4Ij48Y2lyY2xlIGN4PSIxMDAiIGN5PSIxNTgiIHI9IjU4IiBmaWxsPSJub25lIiBzdHJva2U9IiM2Q0FFMkMiIHN0cm9rZS13aWR0aD0iMjkiLz48ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTU4IiByeD0iMTkiIHJ5PSIyMyIgZmlsbD0iI0U4QTIzRCIvPjxwYXRoIGQ9Ik0xMDAgMTM5IEM5MyAxNDkgOTMgMTY3IDEwMCAxNzciIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0M5ODIxRiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNMTAwIDE2MCBMMTAwIDY2IiBmaWxsPSJub25lIiBzdHJva2U9IiMzRjdBMkEiIHN0cm9rZS13aWR0aD0iOCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTEwMCA3NCBDODMgNzUgNTYgNjcgMzkgNDUgQzM1IDQxIDM3IDM0IDQzIDM0IEM3MiAzNyA5NiA1MCAxMDAgNzQgWiIgZmlsbD0iIzVFQTEyNiIvPjxwYXRoIGQ9Ik05OCA3MiBDODEgNjIgNjMgNTIgNDUgNDEiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNMTAwIDc0IEMxMTcgNzUgMTQ0IDY3IDE2MSA0NSBDMTY1IDQxIDE2MyAzNCAxNTcgMzQgQzEyOCAzNyAxMDQgNTAgMTAwIDc0IFoiIGZpbGw9IiM4NEM2M0MiLz48cGF0aCBkPSJNMTAyIDcyIEMxMTkgNjIgMTM3IDUyIDE1NSA0MSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2A5325',
        }}
      >
        <img
          src={`data:image/svg+xml;base64,${LOGO_B64}`}
          width={105}
          height={131}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size }
  );
}
