import { columns, Payment } from "./columns"
import { DataTable } from "../../components/data-table"

function getData(): Payment[] {
  // Fetch data from your API here.
  return [
    {
      id: "728ed52f",
      amount: 100,
      status: "pending",
      email: "m@example.com",
    },
    {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },

        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
        {
      id: "728ed52g",
      amount: 500,
      status: "processing",
      email: "z@example.com",
    },
    // ...
  ]
}

export default function Transaction() {
  const data = getData()

  return (
    <div className="container mx-auto">
      <DataTable columns={columns} data={data} searchPlaceholder="Search transactions..." exportFileName="transactions"/>
    </div>
  )
}