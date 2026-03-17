import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  AlertTriangle, 
  ShieldAlert, 
  Info, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Zap,
  FileText,
  Search,
  MessageSquare
} from 'lucide-react';
import { useLanguage } from '../utils/languageContext';

export default function ReviewDetailsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = location.state || {};
  const { t } = useLanguage();

  if (!data) {
    navigate('/');
    return null;
  }

  const fraudFlags = data.ai_insights?.fraud_flags || [];
  const medicalConsistency = data.ai_insights?.medical_consistency;
  const missingItems = data.missing_items || [];
  const auditedMedicines = data.audited_medicines || [];
  const auditedLabs = data.audited_labs || [];

  // Identify specific issues from audited items
  const rateMismatches = [
    ...auditedMedicines,
    ...auditedLabs,
    ...(data.audited_radiology || []),
    ...(data.audited_surgery || []),
    ...(data.audited_general || [])
  ].filter((item: any) => item.bill_rate !== item.hib_rate && item.status !== 'not_found');

  const unnecessaryInvestigations = [
    ...auditedLabs,
    ...(data.audited_radiology || [])
  ].filter((item: any) => item.flag === 'UNNECESSARY_INVESTIGATION');

  const notFoundItems = [
    ...auditedMedicines,
    ...auditedLabs,
    ...(data.audited_radiology || []),
    ...(data.audited_surgery || []),
    ...(data.audited_general || [])
  ].filter((item: any) => item.status === 'not_found');

  return (
    <div className="min-h-screen bg-brand-bg text-[#1E293B] font-sans pb-20">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 p-3 sm:p-4 flex justify-between items-center shadow-sm">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 sm:gap-2 font-black uppercase text-[8px] sm:text-[10px] tracking-widest text-slate-500 hover:text-brand-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> <span>{t.backToUpload}</span>
        </button>
        <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
          <ShieldAlert className="w-3 h-3" />
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">{t.reviewDetails}</span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        <header className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-slate-900">{t.reviewFlags}</h2>
          <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-tight">
            Audit ID: {data.id?.substring(0, 8) || "N/A"} • {data.patient?.name}
          </p>
        </header>

        {/* Severity Summary Card */}
        <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Overall Risk Profile</p>
              <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">
                {fraudFlags.length > 0 ? "High Risk Anomaly Detected" : "Medium Risk Review Required"}
              </h3>
            </div>
            <div className="flex gap-4">
              <div className="text-center px-4 py-2 bg-white/10 rounded-xl border border-white/10">
                <p className="text-[8px] font-black uppercase opacity-60 mb-1">Total Flags</p>
                <p className="text-xl font-black">{fraudFlags.length + rateMismatches.length + unnecessaryInvestigations.length}</p>
              </div>
              <div className="text-center px-4 py-2 bg-white/10 rounded-xl border border-white/10">
                <p className="text-[8px] font-black uppercase opacity-60 mb-1">Missing Docs</p>
                <p className="text-xl font-black">{missingItems.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Issues List */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{t.flaggedIssues}</h3>
          
          <div className="grid grid-cols-1 gap-4">
            {/* Fraud/Anomaly Flags */}
            {fraudFlags.map((flag: string, i: number) => (
              <IssueCard 
                key={`fraud-${i}`}
                icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                title={flag}
                description="Potential billing anomaly or pattern inconsistent with standard HIB claim submissions."
                severity={t.highSeverity}
                severityColor="text-red-600 bg-red-50 border-red-100"
                recommendation="Manual verification of physical bill and hospital ledger required."
              />
            ))}

            {/* Rate Mismatches */}
            {rateMismatches.length > 0 && (
              <IssueCard 
                icon={<Zap className="w-5 h-5 text-amber-500" />}
                title={`${rateMismatches.length} Rate Mismatches Identified`}
                description="Billed rates exceed the maximum allowable rates defined in the HIB 2081 price list."
                severity={t.mediumSeverity}
                severityColor="text-amber-600 bg-amber-50 border-amber-100"
                recommendation="Adjust claim amount to match HIB approved rates before processing."
              />
            )}

            {/* Unnecessary Investigations */}
            {unnecessaryInvestigations.length > 0 && (
              <IssueCard 
                icon={<Search className="w-5 h-5 text-purple-500" />}
                title="Clinical Necessity Flags"
                description={`${unnecessaryInvestigations.length} investigations flagged as potentially unnecessary based on the recorded diagnosis.`}
                severity={t.mediumSeverity}
                severityColor="text-purple-600 bg-purple-50 border-purple-100"
                recommendation="Review clinical justification or request additional medical notes from the officer."
              />
            )}

            {/* Missing Items */}
            {missingItems.length > 0 && (
              <IssueCard 
                icon={<FileText className="w-5 h-5 text-slate-500" />}
                title="Documentation Deficiencies"
                description={`Mandatory elements missing: ${missingItems.join(', ').replace(/_/g, ' ')}.`}
                severity={t.highSeverity}
                severityColor="text-red-600 bg-red-50 border-red-100"
                recommendation="Reject claim and request resubmission with complete documentation."
              />
            )}

            {/* Not Found Items */}
            {notFoundItems.length > 0 && (
              <IssueCard 
                icon={<XCircle className="w-5 h-5 text-slate-400" />}
                title="Non-Covered Items"
                description={`${notFoundItems.length} items identified that are not currently included in the HIB 2081 benefit package.`}
                severity={t.lowSeverity}
                severityColor="text-slate-600 bg-slate-50 border-slate-100"
                recommendation="Deduct these items from the total claim amount."
              />
            )}
          </div>
        </div>

        {/* Clinical Consistency Detail */}
        <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-brand-primary" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">{t.medicalConsistency}</h3>
          </div>
          <p className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-4 border-brand-primary pl-4">
            {medicalConsistency || "No specific clinical inconsistencies noted beyond flagged items."}
          </p>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => navigate(-1)}
          className="w-full bg-[#141414] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-opacity-90 transition-all shadow-xl shadow-slate-200"
        >
          Return to Audit Summary
        </button>
      </main>
    </div>
  );
}

function IssueCard({ icon, title, description, severity, severityColor, recommendation }: any) {
  const { t } = useLanguage();
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex gap-4">
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-black uppercase tracking-tighter text-slate-900">{title}</h4>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${severityColor}`}>
          {t.severity}: {severity}
        </div>
      </div>
      
      <div className="pt-4 border-t border-slate-50">
        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">{t.recommendation}</p>
        <p className="text-xs font-bold text-slate-700">{recommendation}</p>
      </div>
    </motion.div>
  );
}
