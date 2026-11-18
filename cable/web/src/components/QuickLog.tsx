import { useEffect, useState } from 'react';
import { api } from '../api';
import type { SubjectWithTopics } from '../types';
import { StudyLogDialog, type TopicOption } from './StudyLogDialog';

export function QuickLog({
  examId,
  onClose,
  onSaved,
}: {
  examId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [topics, setTopics] = useState<TopicOption[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<{ subjects: SubjectWithTopics[] }>(`/exams/${examId}/subjects`)
      .then(data => {
        if (!alive) return;
        setTopics(
          data.subjects.flatMap(subject =>
            subject.topics.map(topic => ({
              id: topic.id,
              title: topic.title,
              subjectName: subject.name,
            }))
          )
        );
      })
      .catch(() => alive && setTopics([]));
    return () => {
      alive = false;
    };
  }, [examId]);

  if (topics === null) return null;

  return <StudyLogDialog examId={examId} topics={topics} onClose={onClose} onSaved={onSaved} />;
}
