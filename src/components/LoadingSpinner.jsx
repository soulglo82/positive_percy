
export default function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" role="status">
      <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin mb-4" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
