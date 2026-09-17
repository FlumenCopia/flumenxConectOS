'use client';

import React, { useEffect, useState } from 'react';
import {
  portalListTasksApi,
  portalCompleteTaskApi,
  portalAddTaskCommentApi,
  PortalTaskItem,
} from '@/lib/api/portal';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  X,
  Loader2,
  Send,
  Calendar,
} from 'lucide-react';

export default function PortalTasksPage() {
  const [tasks, setTasks] = useState<PortalTaskItem[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [loading, setLoading] = useState(true);

  // Complete Task Modal State
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PortalTaskItem | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // Comment Modal State
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      const data = await portalListTasksApi();
      setTasks(data);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to load action items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleOpenCompleteModal = (task: PortalTaskItem) => {
    setSelectedTask(task);
    setCompletionNotes('');
    setCompleteModalOpen(true);
  };

  const handleOpenCommentModal = (task: PortalTaskItem) => {
    setSelectedTask(task);
    setCommentText('');
    setCommentModalOpen(true);
  };

  const handleConfirmCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    setCompleting(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      await portalCompleteTaskApi(selectedTask._id, completionNotes.trim() || undefined);
      setFeedbackMessage(`Action item "${selectedTask.title}" marked as completed.`);
      setCompleteModalOpen(false);
      await loadTasks();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to complete action item');
    } finally {
      setCompleting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !commentText.trim()) return;

    setCommenting(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      await portalAddTaskCommentApi(selectedTask._id, commentText.trim());
      setFeedbackMessage('Your comment has been forwarded to the account team.');
      setCommentModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to submit comment');
    } finally {
      setCommenting(false);
    }
  };

  const pendingTasks = tasks.filter((t) => !t.customerCompletedAt && t.status !== 'completed');
  const completedTasks = tasks.filter((t) => !!t.customerCompletedAt || t.status === 'completed');

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
        <p className="text-sm">Loading action items & tasks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Action Items & Tasks</h1>
        <p className="text-sm text-slate-400 mt-1">
          Review required onboarding actions, document requirements, and client tasks
        </p>
      </div>

      {feedbackMessage && (
        <div
          id="task-feedback-alert"
          className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center space-x-3"
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          id="task-error-alert"
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center space-x-3"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-1">
        <button
          id="tasks-pending-tab"
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'pending'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Pending Items ({pendingTasks.length})
        </button>
        <button
          id="tasks-completed-tab"
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'completed'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Completed History ({completedTasks.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'pending' ? (
        pendingTasks.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No pending action items</h3>
            <p className="text-xs text-slate-400 mt-1">You have completed all requirements assigned to you.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTasks.map((task) => (
              <div
                key={task._id}
                id={`task-card-${task._id}`}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      {task.customerActionRequired && (
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Action Required
                        </span>
                      )}
                      <span className="text-xs text-slate-400 capitalize bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                        {task.taskType.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">{task.title}</h3>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Due: {new Date(task.dueAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {task.description && (
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                    {task.description}
                  </p>
                )}

                {task.customerActionDescription && (
                  <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300">
                    <span className="font-semibold block mb-0.5">Instructions from team:</span>
                    {task.customerActionDescription}
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                  <button
                    id={`task-comment-btn-${task._id}`}
                    onClick={() => handleOpenCommentModal(task)}
                    className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Leave a note / question</span>
                  </button>

                  {task.customerActionRequired && (
                    <button
                      id={`task-complete-btn-${task._id}`}
                      onClick={() => handleOpenCompleteModal(task)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Action Completed</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : completedTasks.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
          No completed tasks in your history.
        </div>
      ) : (
        <div className="space-y-3">
          {completedTasks.map((task) => (
            <div
              key={task._id}
              className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-slate-200">{task.title}</h4>
                </div>
                {task.customerCompletedAt && (
                  <p className="text-xs text-slate-500 pl-6">
                    Completed by you on {new Date(task.customerCompletedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Completed
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Mark Task Action Completed */}
      {completeModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Complete Action Item</h3>
              <button
                onClick={() => setCompleteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Confirm you have finished the required action for{' '}
              <strong className="text-white">"{selectedTask.title}"</strong>.
            </p>

            <form onSubmit={handleConfirmCompletion} className="space-y-4">
              <div>
                <label htmlFor="completion-notes-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Completion Notes (Optional)
                </label>
                <textarea
                  id="completion-notes-input"
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Uploaded the requested utility bill and signed agreement."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  id="confirm-complete-task-btn"
                  type="submit"
                  disabled={completing}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/25 flex items-center space-x-1.5"
                >
                  {completing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Confirm Completion</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Leave Task Comment */}
      {commentModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Task Note / Question</h3>
              <button
                onClick={() => setCommentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddComment} className="space-y-4">
              <div>
                <label htmlFor="task-comment-textarea" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Your Message to Team
                </label>
                <textarea
                  id="task-comment-textarea"
                  required
                  rows={4}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Need clarification or have a question about this item? Write here..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCommentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  id="submit-task-comment-btn"
                  type="submit"
                  disabled={commenting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/25 flex items-center space-x-1.5"
                >
                  {commenting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Post Comment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
