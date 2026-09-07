import { redirect } from 'next/navigation'

/** Home is the desk's landing screen; `/` exists only to get there. */
export default function RootPage() {
  redirect('/home')
}
