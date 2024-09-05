export default function Image({ src, ...rest }) {
  // Set a default or fallback for src in case it is undefined or null
  const defaultSrc = 'http://airbnb-clone-ih0r7gqbi-dumichandas-projects.vercel.app/uploads/default.jpg'; // Use a default image if src is undefined
  src = src 
    ? (src.includes('https://') ? src : `http://airbnb-clone-ih0r7gqbi-dumichandas-projects.vercel.app/uploads/${src}`)
    : defaultSrc; // If src is undefined, use a default image

  return (
    <img {...rest} src={src} alt={rest.alt || 'Image'} /> // Use alt prop or default to 'Image'
  );
}
