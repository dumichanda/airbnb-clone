export default function Image({src,...rest}) {
  src = src && src.includes('https://')
  ? src
  : 'http://airbnb-clone-ih0r7gqbi-dumichandas-projects.vercel.app/uploads/' + src; 
  return (
    <img {...rest} src={src} alt={''} />
  );
}
src = src && src.includes('https://')
  ? src
  : 'http://airbnb-clone-ih0r7gqbi-dumichandas-projects.vercel.app/uploads/' + src;
