interface Props {
  svg: string;
}

export function SvgPreview({ svg }: Props) {
  return (
    <section>
      <h2>SVG Output</h2>
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: 4,
          padding: 16,
          overflow: 'auto',
          background: '#fff',
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </section>
  );
}
