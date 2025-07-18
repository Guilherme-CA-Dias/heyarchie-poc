"use client";

import { Loader2 } from "lucide-react";

export default function LoadingState() {
	return (
		<div className="flex items-center justify-center py-8">
			<Loader2 className="h-6 w-6 animate-spin" />
			<span className="ml-2">Loading transactions...</span>
		</div>
	);
}
