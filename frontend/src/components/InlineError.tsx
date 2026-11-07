export default function InlineError({ message }: { message: string }) {
  return <div className="error-box" role="alert"><span aria-hidden="true">!</span><p>{message}</p></div>
}
