export default function Image({src,...rest}) {
  src = src && src.includes('https://')
    ? src
    : 'http://https://airbnb-clone-ih0r7gqbi-dumichandas-projects.vercel.app
/uploads/'+src;
  return (
    <img {...rest} src={src} alt={''} />
  );
}
