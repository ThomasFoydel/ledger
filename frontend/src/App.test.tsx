import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import * as api from './api'
import type { Product } from './api'

vi.mock('./api', () => ({
  getCurrentUser: vi.fn(),
  getProducts: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}))

const sampleProduct: Product = {
  id: 'product-1',
  name: 'Lavender Soap',
  description: 'Handmade lavender bar',
  price: 8.5,
  isActive: true,
  createdAtUtcs: '2026-01-01T12:00:00Z',
  quantityOnHand: 12,
}

async function renderSignedIn(products: Product[] = []) {
  vi.mocked(api.getCurrentUser).mockResolvedValue({
    email: 'owner@example.com',
  })
  vi.mocked(api.getProducts).mockResolvedValue(products)

  render(<App />)

  expect(
    await screen.findByText('Signed in as owner@example.com'),
  ).toBeInTheDocument()
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('App authentication', () => {
  it('shows the login form when signed out', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null)

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Ledger' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('logs in and displays the authenticated user', async () => {
    const user = userEvent.setup()

    vi.mocked(api.getCurrentUser)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ email: 'owner@example.com' })
    vi.mocked(api.login).mockResolvedValue(undefined)
    vi.mocked(api.getProducts).mockResolvedValue([])

    render(<App />)

    await user.type(
      await screen.findByLabelText('Email'),
      'owner@example.com',
    )
    await user.type(screen.getByLabelText('Password'), 'example-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByText('Signed in as owner@example.com'),
    ).toBeInTheDocument()
    expect(api.login).toHaveBeenCalledWith(
      'owner@example.com',
      'example-password',
    )
  })

  it('displays an error when login fails', async () => {
    const user = userEvent.setup()

    vi.mocked(api.getCurrentUser).mockResolvedValue(null)
    vi.mocked(api.login).mockRejectedValue(
      new Error('Invalid email or password.'),
    )

    render(<App />)

    await user.type(
      await screen.findByLabelText('Email'),
      'owner@example.com',
    )
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.',
    )
  })
})

describe('Product management', () => {
  it('displays products, prices, and inventory quantities', async () => {
    await renderSignedIn([sampleProduct])

    expect(
      screen.getByRole('heading', { name: 'Lavender Soap' }),
    ).toBeInTheDocument()
    expect(screen.getByText('$8.50')).toBeInTheDocument()
    expect(screen.getByText('Handmade lavender bar')).toBeInTheDocument()
    expect(screen.getByText('In stock:').parentElement).toHaveTextContent(
      'In stock: 12',
    )
  })

  it('creates a product and refreshes the list', async () => {
    const user = userEvent.setup()

    vi.mocked(api.createProduct).mockResolvedValue(sampleProduct)
    vi.mocked(api.getProducts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([sampleProduct])

    await renderSignedIn()

    await user.type(screen.getByLabelText('Name'), 'Lavender Soap')
    await user.type(
      screen.getByLabelText('Description'),
      'Handmade lavender bar',
    )
    await user.clear(screen.getByLabelText('Price'))
    await user.type(screen.getByLabelText('Price'), '8.50')
    await user.click(
      screen.getByRole('button', { name: 'Create product' }),
    )

    await waitFor(() => {
      expect(api.createProduct).toHaveBeenCalledWith({
        name: 'Lavender Soap',
        description: 'Handmade lavender bar',
        price: 8.5,
        quantityOnHand: 0,
      })
    })

    expect(
      await screen.findByRole('heading', { name: 'Lavender Soap' }),
    ).toBeInTheDocument()
  })

  it('edits a product and saves the updated values', async () => {
    const user = userEvent.setup()

    vi.mocked(api.updateProduct).mockResolvedValue({
      ...sampleProduct,
      name: 'Mint Soap',
      price: 9,
    })
    vi.mocked(api.getProducts)
      .mockResolvedValueOnce([sampleProduct])
      .mockResolvedValueOnce([
        { ...sampleProduct, name: 'Mint Soap', price: 9 },
      ])

    await renderSignedIn([sampleProduct])

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Mint Soap')

    const priceInput = screen.getByLabelText('Price')
    await user.clear(priceInput)
    await user.type(priceInput, '9.00')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(api.updateProduct).toHaveBeenCalledWith('product-1', {
        name: 'Mint Soap',
        description: 'Handmade lavender bar',
        price: 9,
        quantityOnHand: 12,
      })
    })

    expect(
      await screen.findByRole('heading', { name: 'Mint Soap' }),
    ).toBeInTheDocument()
  })

  it('deletes a product after confirmation', async () => {
    const user = userEvent.setup()

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.deleteProduct).mockResolvedValue(undefined)

    await renderSignedIn([sampleProduct])

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(api.deleteProduct).toHaveBeenCalledWith('product-1')
    })

    expect(
      screen.queryByRole('heading', { name: 'Lavender Soap' }),
    ).not.toBeInTheDocument()
  })

  it('does not delete a product when confirmation is declined', async () => {
    const user = userEvent.setup()

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    await renderSignedIn([sampleProduct])

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(api.deleteProduct).not.toHaveBeenCalled()
    expect(
      screen.getByRole('heading', { name: 'Lavender Soap' }),
    ).toBeInTheDocument()
  })

  it('shows an error when product creation fails', async () => {
    const user = userEvent.setup()

    vi.mocked(api.createProduct).mockRejectedValue(
      new Error('Could not create product.'),
    )

    await renderSignedIn()

    await user.type(screen.getByLabelText('Name'), 'Lavender Soap')
    await user.click(
      screen.getByRole('button', { name: 'Create product' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not create product.',
    )
  })
})
