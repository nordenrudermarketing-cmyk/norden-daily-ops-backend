import { supabase } from '../supabaseClient.js';

// 如果傳進來的是 base64 照片資料（data:image/...;base64,...），
// 就把它上傳到 Supabase Storage 的 photos 這個 bucket，並回傳存好之後的網址；
// 如果傳進來的已經是網址（或是空值），就原封不動回傳，不會重複上傳。
// 上傳失敗的話（例如還沒建立 bucket），退回原本存 base64 的做法，不會讓照片憑空消失。
export async function uploadPhotoIfBase64(dataUrl, folder) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return dataUrl || null;
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return dataUrl;

  const mimeType = match[1];
  const base64Data = match[2];
  const ext = (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error('照片上傳到 Storage 失敗，改用原本方式存底：', uploadError.message);
      return dataUrl;
    }

    const { data } = supabase.storage.from('photos').getPublicUrl(fileName);
    return data?.publicUrl || dataUrl;
  } catch (err) {
    console.error('照片處理發生例外，改用原本方式存底：', err.message);
    return dataUrl;
  }
}
