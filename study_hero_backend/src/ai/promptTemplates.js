function buildMessages(system, user, context = '') {
    return [
        { role: 'system', content: `${system}\nReturn useful, concise, production-ready educational output. Do not invent database records.` },
        { role: 'user', content: context ? `${context}\n\n${user}` : user }
    ];
}

const prompts = {
    assistant: ({ message }) => buildMessages('You are Study Hero AI Tutor. Help the authenticated learner with study guidance.', message),
    pdfChat: ({ question, documentText }) => buildMessages('Answer only from the provided PDF text when possible. If the answer is not present, say what is missing.', question, `PDF context:\n${documentText}`),
    quiz: ({ context, difficulty, bloomLevel, questionTypes, count }) => buildMessages('Generate an advanced quiz. Include question type, options where relevant, correct answer, explanation, difficulty, and Bloom taxonomy level.', `Create ${count || 5} questions. Difficulty: ${difficulty || 'mixed'}. Bloom level: ${bloomLevel || 'mixed'}. Types: ${(questionTypes || ['mcq']).join(', ')}. Context:\n${context}`),
    assignment: ({ context, difficulty }) => buildMessages('Generate a rigorous assignment with objectives, tasks, rubric, and submission guidance.', `Difficulty: ${difficulty || 'intermediate'}\nContext:\n${context}`),
    planner: ({ goals, availability, deadline }) => buildMessages('Create a practical study plan with milestones and review sessions.', `Goals: ${goals}\nAvailability: ${availability || 'not specified'}\nDeadline: ${deadline || 'not specified'}`),
    weakTopics: ({ performance }) => buildMessages('Analyze quiz performance and identify weak topics, likely causes, and next actions.', JSON.stringify(performance, null, 2)),
    recommendations: ({ learnerProfile }) => buildMessages('Recommend next learning actions based on real course, assignment, and quiz performance data.', JSON.stringify(learnerProfile, null, 2)),
    flashcards: ({ context, count }) => buildMessages('Generate flashcards as question and answer pairs.', `Generate ${count || 10} flashcards from:\n${context}`),
    summary: ({ context }) => buildMessages('Create structured notes and a concise summary.', context),
    doubt: ({ question, context }) => buildMessages('Solve the student doubt step by step and include a quick practice check.', question, context || '')
};

module.exports = prompts;