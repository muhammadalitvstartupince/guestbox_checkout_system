import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-[#0d1b2a]">
      <Image
        src="/pages_Images/GuestBox-Logo-5v2.png"
        alt="GuestBox"
        width={492}
        height={141}
        priority
        className="h-auto w-72 sm:w-80 md:w-96"
      />
    </div>
  );
}
