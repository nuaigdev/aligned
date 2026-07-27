import NewProjectForm from './NewProjectForm'

export default function NewProjectPage({
  searchParams,
}: {
  searchParams: { client?: string }
}) {
  return <NewProjectForm defaultClientId={searchParams.client} />
}
