import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function QRCodeOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const currentUrl = window.location.href;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow border border-gray-200 z-40 group"
        title="Show QR Code for Mobile Access"
      >
        <QrCode className="w-6 h-6 text-brand-primary group-hover:scale-110 transition-transform" />
      </button>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center"
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Scan to Open on Mobile</h3>
                <p className="text-base text-gray-500">
                  Point your phone's camera at this code to open the app instantly.
                </p>
              </div>

              <div className="flex justify-center p-6 bg-gray-50 rounded-3xl border border-gray-100 mb-8">
                <QRCodeSVG
                  value={currentUrl}
                  size={320}
                  level="H"
                  includeMargin={true}
                  className="rounded-xl shadow-sm"
                />
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-brand-bg rounded-xl border border-gray-200 break-all text-xs font-mono text-gray-600">
                  {currentUrl}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentUrl);
                    // Could add a toast here if available
                  }}
                  className="w-full py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors"
                >
                  Copy URL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
