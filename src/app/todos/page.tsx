import { createClient } from "../../../utils/supabase/server";

export default async function TodosPage() {
  const supabase = await createClient();
  const { data: todos, error } = await supabase.from("todos").select();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Todos</h1>
      {error ? (
        <p className="mt-4 text-red-700">Unable to load todos.</p>
      ) : (
        <ul className="mt-4 list-disc pl-6">
          {todos?.map((todo) => (
            <li key={todo.id}>{todo.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
