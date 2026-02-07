export async function UploadFile({ file }) {
  // Read file as data URL, then upload to server
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: dataUrl, content_type: file.type }),
  });

  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}
