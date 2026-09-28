import { beforeAll } from 'vitest'

/** jsdom has `<dialog>` but not its modal methods; these do what the list kit relies on. */
export function stubDialogMethods(): void {
  beforeAll(() => {
    const proto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>
    if (typeof proto.showModal !== 'function') {
      proto.showModal = function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      }
    }
    if (typeof proto.close !== 'function') {
      proto.close = function (this: HTMLDialogElement) {
        this.removeAttribute('open')
      }
    }
  })
}
