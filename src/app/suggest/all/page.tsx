import { Suspense } from 'react';
import SuggestAll from "@/components/Suggest/SuggestAll";

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600 text-lg">載入中...</p>
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <SuggestAll />
        </Suspense>
    );
}
