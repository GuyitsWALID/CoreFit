import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fingerprint } from "lucide-react";

interface FingerprintScannerCardProps {
  status: "idle" | "scanning" | "success" | "error";
  onStart: () => void;
  onDone: () => void;
  onRetry?: () => void;
  registeredClientName?: string;
}

export const FingerprintScannerCard: React.FC<FingerprintScannerCardProps> = ({
  status,
  onStart,
  onDone,
  onRetry,
  registeredClientName = "the client",
}) => (
  <Card className="max-w-2xl">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <span className="text-2xl">👆</span>
        Fingerprint Enrollment
      </CardTitle>
      <CardDescription>
        Enroll {registeredClientName}'s fingerprint for secure check-in access.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-32 h-32 bg-gradient-to-b from-teal-400 to-teal-600 rounded-full flex items-center justify-center mb-4">
          <Fingerprint className="w-16 h-16 text-white" />
        </div>
        {status === "idle" && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Touch the fingerprint sensor to enroll {registeredClientName}'s fingerprint
            </p>
            <Button
              onClick={onStart}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Start Fingerprint Enrollment
            </Button>
          </div>
        )}
        {status === "scanning" && (
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="w-4 h-4 bg-teal-600 rounded-full mx-auto mb-2"></div>
              <p className="text-teal-600 font-medium">
                Enrolling fingerprint...
              </p>
              <p className="text-sm text-gray-500">
                Please keep finger on sensor
              </p>
            </div>
            <div className="flex justify-center">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
        {status === "success" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-600 font-medium">
              Fingerprint enrolled successfully!
            </p>
            <p className="text-sm text-gray-500">
              {registeredClientName} can now use fingerprint for check-in
            </p>
          </div>
        )}
        {status === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">
              Fingerprint enrollment failed!
            </p>
            {onRetry && (
              <Button onClick={onRetry} variant="outline">
                Try Again
              </Button>
            )}
          </div>
        )}
      </div>
    </CardContent>
    <CardFooter className="flex justify-between">
      <Button variant="outline" onClick={onDone}>
        Register Another Client
      </Button>
      {status === "success" && (
        <Button
          className="bg-fitness-primary hover:bg-fitness-primary/90 text-white"
          onClick={onDone}
        >
          Complete Registration
        </Button>
      )}
    </CardFooter>
  </Card>
);

export default FingerprintScannerCard;
