import '@testing-library/jest-dom/vitest'

// Os testes não saem para a rede: quem precisa de dados passa um fetch ou um Markets falso.
globalThis.fetch = async () => {
  throw new Error('sem rede nos testes')
}
