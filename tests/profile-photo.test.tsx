// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileSheet from '../src/components/ProfileSheet'
import Avatar from '../src/components/Avatar'
import { publishProfile } from '../src/lib/profiles'
import type { Auth, ProfileFields } from '../src/hooks/useAuth'

const service = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn().mockResolvedValue({ error: null }),
  save: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: () => {
      const result = { data: [], error: null, count: 0 }
      const chain: Record<string, unknown> = {
        then: (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve),
        maybeSingle: () => Promise.resolve({ data: {}, error: null }),
      }
      for (const key of ['select', 'eq', 'in', 'order', 'limit']) chain[key] = () => chain
      return chain
    },
    storage: {
      from: () => ({
        upload: service.upload,
        remove: service.remove,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.com/${path}` } }),
      }),
    },
  },
}))
HTMLDialogElement.prototype.showModal = function () {
  this.open = true
}
HTMLDialogElement.prototype.close = function () {
  this.open = false
}
let id = 0
function mount() {
  const userId = `photo-upload-${++id}`
  const session = { user: { id: userId, email: 'test@example.com' } }
  publishProfile(userId, { first_name: 'Test', avatar_url: 'https://example.com/old.jpg' })
  function Harness() {
    const [url, setUrl] = useState<string | null>('https://example.com/old.jpg')
    const auth = {
      session,
      firstName: 'Test',
      emoji: '🙋',
      avatarUrl: url,
      saveProfile: async (fields: ProfileFields) => {
        const error = await service.save(fields)
        if (!error) {
          publishProfile(userId, fields)
          if (fields.avatar_url !== undefined) setUrl(fields.avatar_url)
        }
        return error
      },
    } as Auth
    return (
      <>
        <Avatar userId={userId} />
        <ProfileSheet
          auth={auth}
          open
          onClose={vi.fn()}
          onViewIntent={vi.fn()}
          onRepost={vi.fn()}
        />
      </>
    )
  }
  render(<Harness />)
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  service.remove.mockResolvedValue({ error: null })
})
test('successful upload uses a new object and updates profile and header together', async () => {
  service.upload.mockResolvedValue({ error: null })
  service.save.mockResolvedValue(null)
  mount()
  const user = userEvent.setup()
  await user.upload(
    screen.getByLabelText('Upload profile photo'),
    new File(['image'], 'portrait.jpg', { type: 'image/jpeg' }),
  )
  await screen.findByText(/Photo updated/)
  const path = service.upload.mock.calls[0][0]
  expect(path).toMatch(/photo-upload-\d+\/[a-f0-9-]+\.jpg$/)
  expect([...document.querySelectorAll('img')].map((img) => img.src)).toEqual([
    `https://example.com/${path}`,
    `https://example.com/${path}`,
  ])
})
test('uploading and a failed profile save keep the previous image intact', async () => {
  let finish!: (value: { error: null }) => void
  service.upload.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  service.save.mockResolvedValue('failed')
  mount()
  const user = userEvent.setup()
  await user.upload(
    screen.getByLabelText('Upload profile photo'),
    new File(['image'], 'portrait.jpg', { type: 'image/jpeg' }),
  )
  expect(
    [...document.querySelectorAll('img')].every((img) => img.src === 'https://example.com/old.jpg'),
  ).toBe(true)
  finish({ error: null })
  await screen.findAllByText(/Could not update your photo/)
  expect(
    [...document.querySelectorAll('img')].every((img) => img.src === 'https://example.com/old.jpg'),
  ).toBe(true)
  expect(service.remove).toHaveBeenCalledWith([service.upload.mock.calls[0][0]])
})
test('unsupported and oversized files never reach storage', async () => {
  mount()
  const user = userEvent.setup({ applyAccept: false })
  await user.upload(
    screen.getByLabelText('Upload profile photo'),
    new File(['x'], 'note.txt', { type: 'text/plain' }),
  )
  await screen.findAllByText('Choose a JPG, PNG, WebP or GIF image.')
  await user.upload(
    screen.getByLabelText('Upload profile photo'),
    new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
  )
  await screen.findAllByText('Choose an image under 4 MB.')
  expect(service.upload).not.toHaveBeenCalled()
})
test('a failed removal preserves the image; success switches all consumers to the fallback', async () => {
  service.save.mockResolvedValueOnce('network failure').mockResolvedValueOnce(null)
  mount()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Remove photo' }))
  await screen.findAllByText('Could not remove your photo. Try again.')
  expect(document.querySelectorAll('img')).toHaveLength(2)
  await user.click(screen.getByRole('button', { name: 'Remove photo' }))
  await waitFor(() => expect(document.querySelector('img')).toBeNull())
})
