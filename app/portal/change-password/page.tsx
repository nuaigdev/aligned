import { getSessionClient } from '@/lib/portal/session-guard'
import ChangePasswordForm from './ChangePasswordForm'

export default async function ChangePasswordPage() {
  const client = await getSessionClient()
  return <ChangePasswordForm forced={client.mustChangePassword} />
}
