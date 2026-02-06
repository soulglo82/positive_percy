export async function UploadFile({ file }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ file_url: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
