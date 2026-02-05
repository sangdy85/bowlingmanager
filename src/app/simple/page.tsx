export const dynamic = 'force-static';

export default function SimplePage() {
    return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
            <h1>Pure Static Page</h1>
            <p>If you can see this, the Next.js static file serving is working.</p>
        </div>
    );
}
