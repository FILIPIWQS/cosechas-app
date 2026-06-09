import './globals.css';

export const metadata = {
  title: 'Cosechas · Contagem de Estoque',
  description: 'Contagem de estoque e lista de reposicao da loja Cosechas',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1E7A46',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
