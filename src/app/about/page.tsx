import { permanentRedirect } from 'next/navigation';
import { PUBLIC_ORIGIN } from '@/lib/public-web';
export const metadata={title:'서비스 이용방법 | 볼링매니저',alternates:{canonical:PUBLIC_ORIGIN+'/guide'}};
export default function AboutPage() {
    permanentRedirect('/guide?tab=service');
}
